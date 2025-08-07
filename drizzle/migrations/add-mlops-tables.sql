-- Create enums first
CREATE TYPE "model_run_status" AS ENUM('running', 'completed', 'failed');
CREATE TYPE "deployment_status" AS ENUM('pending', 'deployed', 'rejected');
CREATE TYPE "sweep_result_status" AS ENUM('running', 'completed', 'failed');
CREATE TYPE "drift_metric_status" AS ENUM('normal', 'warning', 'critical');
CREATE TYPE "drift_metric_type" AS ENUM('feature_drift', 'prediction_drift', 'performance_drift');

-- Model runs table
CREATE TABLE IF NOT EXISTS "model_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_type" varchar NOT NULL,
	"model_version" varchar NOT NULL,
	"training_start" timestamp NOT NULL,
	"training_end" timestamp,
	"status" "model_run_status" DEFAULT 'running',
	"metrics" jsonb DEFAULT '{}',
	"config" jsonb NOT NULL,
	"training_samples" integer DEFAULT 0,
	"validation_samples" integer DEFAULT 0,
	"improvement_threshold" numeric(5,4) DEFAULT '0.02',
	"previous_model_version" varchar,
	"deployment_status" "deployment_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"notes" text
);

-- Sweep results table
CREATE TABLE IF NOT EXISTS "sweep_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sweep_id" varchar NOT NULL,
	"agent_type" varchar NOT NULL,
	"config" jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{}',
	"status" "sweep_result_status" DEFAULT 'running',
	"execution_time" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);

-- Drift metrics table
CREATE TABLE IF NOT EXISTS "drift_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_type" varchar NOT NULL,
	"metric_type" "drift_metric_type" NOT NULL,
	"value" numeric(10,6) NOT NULL,
	"threshold" numeric(10,6) NOT NULL,
	"status" "drift_metric_status" DEFAULT 'normal',
	"details" jsonb DEFAULT '{}',
	"calculated_at" timestamp DEFAULT now(),
	"alert_sent" boolean DEFAULT false
);

-- Model deployments table
CREATE TABLE IF NOT EXISTS "model_deployments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_type" varchar NOT NULL,
	"model_version" varchar NOT NULL,
	"deployed_at" timestamp DEFAULT now(),
	"undeployed_at" timestamp,
	"is_active" boolean DEFAULT true,
	"model_data" jsonb NOT NULL,
	"deployment_config" jsonb DEFAULT '{}',
	"performance_metrics" jsonb DEFAULT '{}'
);

-- Hyperparameter sweeps table
CREATE TABLE IF NOT EXISTS "hyperparameter_sweeps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"agent_type" varchar NOT NULL,
	"parameter_grid" jsonb NOT NULL,
	"status" "sweep_result_status" DEFAULT 'running',
	"total_configurations" integer NOT NULL,
	"completed_configurations" integer DEFAULT 0,
	"best_config" jsonb,
	"best_metrics" jsonb,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_by" varchar,
	"notes" text
);

-- Feature importance table
CREATE TABLE IF NOT EXISTS "feature_importance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_run_id" varchar NOT NULL,
	"agent_type" varchar NOT NULL,
	"feature_name" varchar NOT NULL,
	"importance" numeric(10,6) NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);

-- Model performance history table
CREATE TABLE IF NOT EXISTS "model_performance_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_type" varchar NOT NULL,
	"model_version" varchar NOT NULL,
	"evaluation_date" timestamp DEFAULT now(),
	"metrics" jsonb NOT NULL,
	"dataset_size" integer,
	"evaluation_period" varchar,
	"notes" text
);

-- Training data quality table
CREATE TABLE IF NOT EXISTS "training_data_quality" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_type" varchar NOT NULL,
	"dataset_id" varchar NOT NULL,
	"sample_count" integer NOT NULL,
	"quality_score" numeric(5,4) NOT NULL,
	"completeness_score" numeric(5,4) NOT NULL,
	"consistency_score" numeric(5,4) NOT NULL,
	"validity_score" numeric(5,4) NOT NULL,
	"time_range" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_model_runs_agent_time" ON "model_runs" ("agent_type","training_start");
CREATE INDEX IF NOT EXISTS "idx_model_runs_status" ON "model_runs" ("status");
CREATE INDEX IF NOT EXISTS "idx_model_runs_deployment" ON "model_runs" ("deployment_status");

CREATE INDEX IF NOT EXISTS "idx_sweep_results_sweep_id" ON "sweep_results" ("sweep_id");
CREATE INDEX IF NOT EXISTS "idx_sweep_results_agent_time" ON "sweep_results" ("agent_type","created_at");
CREATE INDEX IF NOT EXISTS "idx_sweep_results_status" ON "sweep_results" ("status");

CREATE INDEX IF NOT EXISTS "idx_drift_metrics_agent_time" ON "drift_metrics" ("agent_type","calculated_at");
CREATE INDEX IF NOT EXISTS "idx_drift_metrics_status" ON "drift_metrics" ("status");
CREATE INDEX IF NOT EXISTS "idx_drift_metrics_type" ON "drift_metrics" ("metric_type");

CREATE INDEX IF NOT EXISTS "idx_model_deployments_agent_version" ON "model_deployments" ("agent_type","model_version");
CREATE INDEX IF NOT EXISTS "idx_model_deployments_active" ON "model_deployments" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_hyperparameter_sweeps_agent_time" ON "hyperparameter_sweeps" ("agent_type","started_at");
CREATE INDEX IF NOT EXISTS "idx_hyperparameter_sweeps_status" ON "hyperparameter_sweeps" ("status");

CREATE INDEX IF NOT EXISTS "idx_feature_importance_model_run" ON "feature_importance" ("model_run_id");
CREATE INDEX IF NOT EXISTS "idx_feature_importance_agent_feature" ON "feature_importance" ("agent_type","feature_name");

CREATE INDEX IF NOT EXISTS "idx_model_performance_agent_date" ON "model_performance_history" ("agent_type","evaluation_date");
CREATE INDEX IF NOT EXISTS "idx_model_performance_version" ON "model_performance_history" ("model_version");

CREATE INDEX IF NOT EXISTS "idx_training_data_quality_agent_time" ON "training_data_quality" ("agent_type","created_at");
CREATE INDEX IF NOT EXISTS "idx_training_data_quality_dataset" ON "training_data_quality" ("dataset_id");