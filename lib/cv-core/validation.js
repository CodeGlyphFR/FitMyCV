import fs from "fs/promises";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

let schemaCache = null;
let validatorCache = null;

async function loadSchema() {
  if (schemaCache) return schemaCache;
  const schemaPath = path.join(process.cwd(), "data", "schema.json");
  const schemaRaw = await fs.readFile(schemaPath, "utf-8");
  schemaCache = JSON.parse(schemaRaw);
  return schemaCache;
}

async function getValidator() {
  if (validatorCache) return validatorCache;

  const schema = await loadSchema();
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  addFormats(ajv);

  validatorCache = ajv.compile(schema);
  return validatorCache;
}

export async function validateCv(cv) {
  const validate = await getValidator();
  const valid = !!validate(cv);
  const errors = valid ? [] : (validate.errors || []);

  return { valid, errors };
}
