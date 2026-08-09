# Terraform Infrastructure (AWS)

This directory deploys `flash-cards` to AWS with low-cost defaults and least-privilege access:

- ECS Fargate service (autoscaling)
- Application Load Balancer (HTTP -> HTTPS redirect)
- ACM certificate for `flash-cards.asafreedman.com`
- Route53 alias record
- RDS PostgreSQL (private)
- Secrets Manager for `DATABASE_URL` and `AUTH_JWT_SECRET`
- ECR repository for app images
- Optional CI/CD pipeline (GitHub source -> CodeBuild -> Manual approval -> ECS deploy)

## Cost and Security Defaults

- ECS tasks run in public subnets with security-group ingress restricted to ALB only
- No NAT gateway (reduces fixed monthly cost)
- RDS is private and only reachable from ECS security group
- IAM roles are scoped to required actions; secret read is restricted to a single secret ARN
- CodePipeline `iam:PassRole` is restricted to ECS task roles and `ecs-tasks.amazonaws.com`
- CloudWatch log retention is capped

## Estimated Monthly Cost (us-east-1)

These are rough planning estimates for the Terraform defaults in this folder, assuming 730 hours/month, low traffic, and on-demand pricing.

Cost estimate last reviewed: 2026-08-10
Cost review notes: Updated for public ECS tasks with ALB-only ingress, no NAT gateway, and optional CI/CD pipeline costs.

### Baseline (typical low-traffic production)

| Service | Default sizing in this repo | Estimated monthly cost |
|---|---|---:|
| ECS Fargate app task | 0.5 vCPU, 1 GB RAM, 1 always-on task | $18 - $20 |
| Application Load Balancer | 1 ALB, low LCU usage | $16 - $22 |
| RDS PostgreSQL | db.t4g.micro, single-AZ | $11 - $14 |
| RDS storage | 20 GB gp3 | $2 - $3 |
| Secrets Manager | 1 secret | ~$0.40 |
| ECR storage | Small image footprint | $0.20 - $1 |
| CloudWatch logs | Light logs with retention cap | $1 - $5 |
| CodePipeline | 1 active pipeline | ~$1 |
| CodeBuild | Small build minutes (low commit volume) | ~$1 - $8 |
| S3 artifacts | Small pipeline artifacts | <$1 |
| Route53 DNS record | Alias A record in existing zone | ~$0 |
| ACM public cert | DNS validated cert | $0 |

Estimated baseline total: about $51 - $75 per month.

### Autoscaling impact

- Each additional always-on task with the same size (0.5 vCPU, 1 GB) adds about $18 - $20 per month.
- At max_count = 3, if all 3 tasks run all month, ECS compute would be roughly $54 - $60 per month.

### Major cost multipliers

- Turning on Multi-AZ RDS (`db_multi_az = true`) typically adds about one more DB instance worth of compute cost.
- Data transfer out to the internet can materially increase costs at higher traffic.
- Heavy ALB request volume or high concurrent connections increases LCU charges.
- Frequent commits that trigger image builds can noticeably increase CodeBuild usage charges.

### Why this setup is secure-by-default

- Only the ALB is internet-facing.
- ECS task ingress is limited to the ALB security group.
- Small default task/DB sizing.
- Single-AZ DB by default.

### Important notes

- Prices vary by region and can change over time.
- This estimate excludes taxes, support plans, and unusually high data transfer/log volume.
- For exact numbers, run AWS Pricing Calculator with your expected traffic profile.
- CI policy: if infrastructure files change, this README cost estimate and review date must be updated.

## Prerequisites

1. AWS credentials with permissions to create networking, ECS, ALB, ACM, Route53, RDS, IAM, ECR, Secrets Manager, CodeBuild, CodePipeline, S3, and CodeStar Connections resources.
2. Existing Route53 public hosted zone for `asafreedman.com`.
3. Terraform >= 1.6.
4. A pushed container image for the app (`app_image` variable).
5. If CI/CD is enabled: a GitHub repository and either an existing CodeStar connection ARN or permission to create one.

## Usage

1. Copy `terraform.tfvars.example` to `terraform.tfvars` and set `app_image`.
2. Optional CI/CD: set `enable_ci_pipeline = true`, plus `github_repo_owner`, `github_repo_name`, and `github_branch`.
3. If `github_connection_arn` is empty, Terraform creates a CodeStar connection in `PENDING` status.
4. Complete the GitHub authorization handshake in AWS Console:
	- Developer Tools -> Settings -> Connections
	- Open the created connection and choose `Update pending connection`
5. Initialize and apply:

```bash
terraform init
terraform plan
terraform apply
```

6. Push to your configured branch to trigger the pipeline.
7. In CodePipeline, approve the `Approve` stage to continue deployment to ECS.

## Notes

- The app container expects these runtime secrets: `DATABASE_URL`, `AUTH_JWT_SECRET`, `NODE_ENV`.
- This configuration intentionally uses single-AZ RDS for lower cost. Enable `db_multi_az = true` for higher availability.
- `/stats` route redirects to `/cards` in application code.
- Pipeline build spec is at `buildspec.pipeline.yml` and emits `imagedefinitions.json` for ECS deploy.
