-- AlterTable
ALTER TABLE "public"."CvFile" ADD COLUMN     "language" TEXT;

-- Insert PDF Import Settings
INSERT INTO "public"."Setting" (id, "settingName", value, category, description, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'pdf_image_max_width', '1000', 'pdf_import', 'Largeur max image PDF (px)', NOW(), NOW()),
  (gen_random_uuid(), 'pdf_image_density', '100', 'pdf_import', 'DPI conversion PDF', NOW(), NOW()),
  (gen_random_uuid(), 'pdf_image_quality', '75', 'pdf_import', 'Qualité JPEG (1-100)', NOW(), NOW()),
  (gen_random_uuid(), 'pdf_vision_detail', 'high', 'pdf_import', 'Détail Vision API (low/auto/high)', NOW(), NOW());

-- Insert CV Display Settings
INSERT INTO "public"."Setting" (id, "settingName", value, category, description, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'cv_section_order', '["header","summary","skills","experience","education","languages","extras","projects"]', 'cv_display', 'Ordre affichage sections CV', NOW(), NOW());
