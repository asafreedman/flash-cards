variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used in resource naming."
  type        = string
  default     = "flash-cards"
}

variable "environment" {
  description = "Environment name (for example: prod, staging)."
  type        = string
  default     = "prod"
}

variable "domain_name" {
  description = "Fully qualified app domain."
  type        = string
  default     = "flash-cards.asafreedman.com"
}

variable "hosted_zone_name" {
  description = "Public Route53 hosted zone name (apex), with or without trailing dot."
  type        = string
  default     = "asafreedman.com"
}

variable "app_port" {
  description = "Application container port."
  type        = number
  default     = 3000
}

variable "app_image" {
  description = "Container image URI (prefer ECR image digest or immutable tag)."
  type        = string
}

variable "app_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 512
}

variable "app_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired ECS task count."
  type        = number
  default     = 1
}

variable "min_count" {
  description = "Minimum ECS autoscaling task count."
  type        = number
  default     = 1
}

variable "max_count" {
  description = "Maximum ECS autoscaling task count."
  type        = number
  default     = 3
}

variable "db_instance_class" {
  description = "RDS instance class sized for low cost."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GiB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Storage autoscaling upper bound in GiB."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for higher availability (higher cost)."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "RDS backup retention in days."
  type        = number
  default     = 7
}

variable "log_retention_days" {
  description = "CloudWatch log retention days."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional tags applied to all resources."
  type        = map(string)
  default     = {}
}

variable "enable_ci_pipeline" {
  description = "Enable CodePipeline + CodeBuild for GitHub sourced CI/CD to ECS."
  type        = bool
  default     = false
}

variable "github_repo_owner" {
  description = "GitHub repository owner/org for the deployment source (for example: octocat)."
  type        = string
  default     = ""
}

variable "github_repo_name" {
  description = "GitHub repository name for the deployment source."
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "Git branch that triggers the deployment pipeline."
  type        = string
  default     = "main"
}

variable "github_connection_arn" {
  description = "Optional existing CodeStar connection ARN to GitHub. Leave empty to create one in Terraform."
  type        = string
  default     = ""
}
