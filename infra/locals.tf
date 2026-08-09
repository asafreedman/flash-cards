locals {
  name_prefix = "${var.project_name}-${var.environment}"

  zone_name = trimsuffix(var.hosted_zone_name, ".")

  db_name     = "flashcards"
  db_username = "flashcards"

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}
