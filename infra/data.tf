resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "db_app_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = [for s in aws_subnet.db : s.id]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

resource "aws_db_parameter_group" "small_instance" {
  count = var.enable_small_instance_db_tuning ? 1 : 0

  name_prefix = "${local.name_prefix}-pg-small-"
  family = var.db_parameter_group_family

  # Keep connection pressure predictable and preserve memory headroom on micro/small instances.
  parameter {
    name         = "max_connections"
    value        = tostring(var.db_max_connections)
    apply_method = "pending-reboot"
  }

  # Conservative per-session memory defaults for small nodes.
  parameter {
    name  = "work_mem"
    value = "2048"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "65536"
  }

  # More proactive vacuum/analyze cadence to reduce bloat in long-running small DBs.
  parameter {
    name  = "autovacuum_vacuum_scale_factor"
    value = "0.05"
  }

  parameter {
    name  = "autovacuum_analyze_scale_factor"
    value = "0.02"
  }

  parameter {
    name  = "autovacuum_naptime"
    value = "30"
  }

  # Better fit for gp3-backed storage than legacy spinning-disk defaults.
  parameter {
    name  = "random_page_cost"
    value = "1.1"
  }

  # Prevent forgotten idle transactions from holding locks indefinitely.
  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = "60000"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-pg-small"
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "main" {
  identifier                 = "${replace(local.name_prefix, "-", "")}-pg"
  engine                     = "postgres"
  engine_version             = var.db_engine_version
  instance_class             = var.db_instance_class
  db_name                    = local.db_name
  username                   = local.db_username
  password                   = random_password.db_password.result
  allocated_storage          = var.db_allocated_storage
  max_allocated_storage      = var.db_max_allocated_storage
  storage_encrypted          = true
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.db.id]
  publicly_accessible        = false
  skip_final_snapshot        = true
  deletion_protection        = false
  multi_az                   = var.db_multi_az
  backup_retention_period    = var.db_backup_retention_days
  auto_minor_version_upgrade = true
  parameter_group_name       = var.enable_small_instance_db_tuning ? aws_db_parameter_group.small_instance[0].name : null

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres"
  })
}

resource "random_password" "jwt_secret" {
  length           = 64
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "app_config" {
  name = "${local.name_prefix}/app"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app"
  })
}

resource "aws_secretsmanager_secret_version" "app_config" {
  secret_id = aws_secretsmanager_secret.app_config.id
  secret_string = jsonencode({
    DATABASE_ADMIN_URL = "postgresql://${urlencode(local.db_username)}:${urlencode(random_password.db_password.result)}@${aws_db_instance.main.address}:5432/${urlencode(local.db_name)}?schema=public&options=${urlencode("-c app.app_db_username=${local.db_app_user} -c app.app_db_password=${random_password.db_app_password.result}")}"
    DATABASE_URL       = "postgresql://${urlencode(local.db_app_user)}:${urlencode(random_password.db_app_password.result)}@${aws_db_instance.main.address}:5432/${urlencode(local.db_name)}?schema=public"
    APP_DB_USERNAME    = local.db_app_user
    APP_DB_PASSWORD    = random_password.db_app_password.result
    RESET_MIGRATIONS   = ""
    AUTH_JWT_SECRET    = random_password.jwt_secret.result
    NODE_ENV           = "production"
  })
}
