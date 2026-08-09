resource "random_password" "db_password" {
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

resource "aws_db_instance" "main" {
  identifier                 = "${replace(local.name_prefix, "-", "")}-pg"
  engine                     = "postgres"
  engine_version             = "16.3"
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
  name = "${local.name_prefix}/app-config"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-config"
  })
}

resource "aws_secretsmanager_secret_version" "app_config" {
  secret_id = aws_secretsmanager_secret.app_config.id
  secret_string = jsonencode({
    DATABASE_URL    = "postgresql://${local.db_username}:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/${local.db_name}?schema=public"
    AUTH_JWT_SECRET = random_password.jwt_secret.result
    NODE_ENV        = "production"
  })
}
