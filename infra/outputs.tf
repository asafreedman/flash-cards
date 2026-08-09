output "app_url" {
  description = "Primary HTTPS URL for the application."
  value       = "https://${var.domain_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name."
  value       = aws_lb.app.dns_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for application images."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.app.name
}

output "db_endpoint" {
  description = "RDS endpoint hostname."
  value       = aws_db_instance.main.address
}

output "app_config_secret_arn" {
  description = "Secrets Manager ARN containing runtime app config values."
  value       = aws_secretsmanager_secret.app_config.arn
}

output "codepipeline_name" {
  description = "CodePipeline name when CI pipeline is enabled."
  value       = var.enable_ci_pipeline ? aws_codepipeline.app[0].name : null
}

output "codebuild_project_name" {
  description = "CodeBuild project name when CI pipeline is enabled."
  value       = var.enable_ci_pipeline ? aws_codebuild_project.app[0].name : null
}

output "github_connection_arn" {
  description = "GitHub CodeStar connection ARN used by the pipeline."
  value       = var.enable_ci_pipeline ? local.pipeline_connection_arn : null
}
