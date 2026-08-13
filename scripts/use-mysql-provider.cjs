/**
 * Wechselt den Prisma-Provider für MySQL-Builds.
 * Nutzung: node scripts/use-mysql-provider.cjs && npx prisma generate
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");

const useMysql = process.argv.includes("--mysql");
const provider = useMysql ? "mysql" : "sqlite";

schema = schema.replace(
  /provider\s*=\s*"(sqlite|mysql)"/,
  `provider = "${provider}"`,
);

fs.writeFileSync(schemaPath, schema);
console.log(`Prisma provider auf "${provider}" gesetzt.`);
