/**
 * @fileoverview This file sets up and exports an instance of PrismaClient for database interactions.
 * 
 * The PrismaClient is configured to log various levels of information, including:
 * - "query": Logs all SQL queries that are executed.
 * - "info": Logs general information.
 * - "warn": Logs warnings.
 * - "error": Logs errors.
 * 
 * @module prisma
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
});

export default prisma;
