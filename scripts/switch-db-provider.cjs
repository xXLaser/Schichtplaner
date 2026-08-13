/**
 * Wechselt den Prisma-Provider zwischen sqlite und mysql.
 * Nutzung:
 *   node scripts/switch-db-provider.cjs mysql
 *   node scripts/switch-db-provider.cjs sqlite
 *
 * Danach: npx prisma generate && npx prisma migrate deploy (bzw. db push für MySQL)
 */
const fs = require("fs");
const path = require("path");

const target = (process.argv[2] || "").toLowerCase();
if (target !== "sqlite" && target !== "mysql") {
  console.error("Usage: node scripts/switch-db-provider.cjs <sqlite|mysql>");
  process.exit(1);
}

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");

if (target === "mysql") {
  schema = schema.replace(
    /datasource db \{[\s\S]*?\n\}/,
    `datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}`,
  );
} else {
  schema = schema.replace(
    /datasource db \{[\s\S]*?\n\}/,
    `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`,
  );
}

fs.writeFileSync(schemaPath, schema);
console.log(`Prisma provider → ${target}`);
console.log("Als Nächstes:");
console.log("  npx prisma generate");
if (target === "mysql") {
  console.log('  DATABASE_URL="mysql://..." npx prisma db push');
} else {
  console.log("  npx prisma migrate deploy");
}
