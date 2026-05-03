-- Rename ClaimType enum value: lab_approver → user_submitted_data_approver
-- PostgreSQL 10+ supports ALTER TYPE ... RENAME VALUE
ALTER TYPE "ClaimType" RENAME VALUE 'lab_approver' TO 'user_submitted_data_approver';
