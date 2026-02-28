"use strict";
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.expense.count({ where: { OR: [{ seriesKey: null }, { seriesKey: "" }] } })
  .then(n => { console.log("Still missing seriesKey:", n); })
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => p.$disconnect());
