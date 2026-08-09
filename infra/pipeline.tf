data "aws_caller_identity" "current" {}

locals {
  github_full_repository_id = "${var.github_repo_owner}/${var.github_repo_name}"

  pipeline_connection_arn = var.github_connection_arn != "" ? var.github_connection_arn : (var.enable_ci_pipeline ? aws_codestarconnections_connection.github[0].arn : "")
}

resource "aws_codestarconnections_connection" "github" {
  count = var.enable_ci_pipeline && var.github_connection_arn == "" ? 1 : 0

  name          = "${local.name_prefix}-github-connection"
  provider_type = "GitHub"

  tags = local.common_tags
}

resource "aws_s3_bucket" "pipeline_artifacts" {
  count = var.enable_ci_pipeline ? 1 : 0

  bucket        = "${local.name_prefix}-pipeline-artifacts-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-pipeline-artifacts"
  })
}

resource "aws_s3_bucket_versioning" "pipeline_artifacts" {
  count = var.enable_ci_pipeline ? 1 : 0

  bucket = aws_s3_bucket.pipeline_artifacts[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pipeline_artifacts" {
  count = var.enable_ci_pipeline ? 1 : 0

  bucket = aws_s3_bucket.pipeline_artifacts[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "pipeline_artifacts" {
  count = var.enable_ci_pipeline ? 1 : 0

  bucket = aws_s3_bucket.pipeline_artifacts[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "codebuild_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  count = var.enable_ci_pipeline ? 1 : 0

  name               = "${local.name_prefix}-codebuild-role"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_policy" "codebuild" {
  count = var.enable_ci_pipeline ? 1 : 0

  name        = "${local.name_prefix}-codebuild-policy"
  description = "Permissions for building and pushing app images to ECR"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CodeBuildLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Sid    = "PipelineArtifactBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.pipeline_artifacts[0].arn,
          "${aws_s3_bucket.pipeline_artifacts[0].arn}/*"
        ]
      },
      {
        Sid    = "EcrPushPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetAuthorizationToken",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart"
        ]
        Resource = "*"
      },
      {
        Sid    = "ReadAppConfigSecret"
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.app_config.arn
      },
      {
        Sid    = "CodeBuildVpcNetworking"
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:CreateNetworkInterfacePermission",
          "ec2:DeleteNetworkInterface",
          "ec2:DeleteNetworkInterfacePermission",
          "ec2:DescribeDhcpOptions",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeRouteTables",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "codebuild" {
  count = var.enable_ci_pipeline ? 1 : 0

  role       = aws_iam_role.codebuild[0].name
  policy_arn = aws_iam_policy.codebuild[0].arn
}

resource "aws_codebuild_project" "app" {
  count = var.enable_ci_pipeline ? 1 : 0

  name         = "${local.name_prefix}-app-build"
  service_role = aws_iam_role.codebuild[0].arn

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.pipeline.yml"
  }

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true

    environment_variable {
      name  = "ECR_REPOSITORY_URI"
      value = aws_ecr_repository.app.repository_url
    }

    environment_variable {
      name  = "ECS_CONTAINER_NAME"
      value = "app"
    }

    # Keep build-time secret names aligned with ECS runtime secret names.
    environment_variable {
      name  = "DATABASE_URL"
      type  = "SECRETS_MANAGER"
      value = "${aws_secretsmanager_secret.app_config.arn}:DATABASE_URL"
    }

    environment_variable {
      name  = "AUTH_JWT_SECRET"
      type  = "SECRETS_MANAGER"
      value = "${aws_secretsmanager_secret.app_config.arn}:AUTH_JWT_SECRET"
    }

    environment_variable {
      name  = "NODE_ENV"
      type  = "SECRETS_MANAGER"
      value = "${aws_secretsmanager_secret.app_config.arn}:NODE_ENV"
    }
  }

  tags = local.common_tags
}

resource "aws_codebuild_project" "migrate" {
  count = var.enable_ci_pipeline ? 1 : 0

  name         = "${local.name_prefix}-db-migrate"
  service_role = aws_iam_role.codebuild[0].arn

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.migrate.yml"
  }

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_SMALL"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true

    environment_variable {
      name  = "ECR_REPOSITORY_URI"
      value = aws_ecr_repository.app.repository_url
    }

    environment_variable {
      name  = "DATABASE_URL"
      type  = "SECRETS_MANAGER"
      value = "${aws_secretsmanager_secret.app_config.arn}:DATABASE_URL"
    }
  }

  vpc_config {
    vpc_id = aws_vpc.main.id
    subnets = [for s in aws_subnet.public : s.id]
    security_group_ids = [aws_security_group.ecs.id]
  }

  tags = local.common_tags
}

data "aws_iam_policy_document" "codepipeline_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["codepipeline.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codepipeline" {
  count = var.enable_ci_pipeline ? 1 : 0

  name               = "${local.name_prefix}-codepipeline-role"
  assume_role_policy = data.aws_iam_policy_document.codepipeline_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_policy" "codepipeline" {
  count = var.enable_ci_pipeline ? 1 : 0

  name        = "${local.name_prefix}-codepipeline-policy"
  description = "Permissions for GitHub source, CodeBuild, and ECS deploy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "PipelineArtifactBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.pipeline_artifacts[0].arn,
          "${aws_s3_bucket.pipeline_artifacts[0].arn}/*"
        ]
      },
      {
        Sid    = "UseCodeStarConnection"
        Effect = "Allow"
        Action = [
          "codestar-connections:UseConnection"
        ]
        Resource = local.pipeline_connection_arn
      },
      {
        Sid    = "CodeBuildStartAndRead"
        Effect = "Allow"
        Action = [
          "codebuild:BatchGetBuilds",
          "codebuild:StartBuild"
        ]
        Resource = [
          aws_codebuild_project.app[0].arn,
          aws_codebuild_project.migrate[0].arn
        ]
      },
      {
        Sid    = "EcsDeploy"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService"
        ]
        Resource = "*"
      },
      {
        Sid    = "PassEcsRoles"
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.ecs_task.arn
        ]
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "codepipeline" {
  count = var.enable_ci_pipeline ? 1 : 0

  role       = aws_iam_role.codepipeline[0].name
  policy_arn = aws_iam_policy.codepipeline[0].arn
}

resource "aws_codepipeline" "app" {
  count = var.enable_ci_pipeline ? 1 : 0

  name     = "${local.name_prefix}-app-pipeline"
  role_arn = aws_iam_role.codepipeline[0].arn

  artifact_store {
    location = aws_s3_bucket.pipeline_artifacts[0].bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "GitHubSource"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = local.pipeline_connection_arn
        FullRepositoryId = local.github_full_repository_id
        BranchName       = var.github_branch
        DetectChanges    = "true"
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "DockerBuildAndPush"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]

      configuration = {
        ProjectName = aws_codebuild_project.app[0].name
      }
    }
  }

  stage {
    name = "Migrate"

    action {
      name            = "PrismaMigrateDeploy"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ProjectName = aws_codebuild_project.migrate[0].name
      }
    }
  }

  stage {
    name = "Approve"

    action {
      name     = "ManualApproval"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"

      configuration = {
        CustomData = "Approve promotion of the built image to ECS production service."
      }
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "DeployToEcs"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ClusterName = aws_ecs_cluster.main.name
        ServiceName = aws_ecs_service.app.name
        FileName    = "imagedefinitions.json"
      }
    }
  }

  tags = local.common_tags

  lifecycle {
    precondition {
      condition     = !var.enable_ci_pipeline || (var.github_repo_owner != "" && var.github_repo_name != "")
      error_message = "When enable_ci_pipeline is true, set github_repo_owner and github_repo_name."
    }
  }
}