-- DropForeignKey
ALTER TABLE "sample" DROP CONSTRAINT "sample_peptide_id_fkey";

-- DropForeignKey
ALTER TABLE "sample" DROP CONSTRAINT "sample_vendor_id_fkey";

-- DropForeignKey
ALTER TABLE "test_claim_template" DROP CONSTRAINT "test_claim_template_test_id_fkey";

-- AlterTable
ALTER TABLE "peptide" ALTER COLUMN "aliases" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "sample" ADD CONSTRAINT "sample_peptide_id_fkey" FOREIGN KEY ("peptide_id") REFERENCES "peptide"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample" ADD CONSTRAINT "sample_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_claim_template" ADD CONSTRAINT "test_claim_template_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
