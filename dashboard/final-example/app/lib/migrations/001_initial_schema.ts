/**
 * Migration: Initial Schema
 *
 * Creates the initial database schema with users, customers, invoices, and revenue tables.
 * This migration documents the existing schema created by the seed script.
 */

import { sql } from '@vercel/postgres';
import type { Migration } from './runner';

export const initialSchema: Migration = {
  id: '001_initial_schema',
  name: 'Create initial schema',

  async up() {
    // Enable UUID extension
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `;

    // Create customers table
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        image_url VARCHAR(255) NOT NULL
      )
    `;

    // Create invoices table
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        customer_id UUID NOT NULL REFERENCES customers(id),
        amount INT NOT NULL,
        status VARCHAR(255) NOT NULL,
        date DATE NOT NULL
      )
    `;

    // Create revenue table
    await sql`
      CREATE TABLE IF NOT EXISTS revenue (
        month VARCHAR(4) NOT NULL UNIQUE,
        revenue INT NOT NULL
      )
    `;

    console.log('Created tables: users, customers, invoices, revenue');
  },

  async down() {
    // Drop tables in reverse order (respect foreign keys)
    await sql`DROP TABLE IF EXISTS invoices`;
    await sql`DROP TABLE IF EXISTS revenue`;
    await sql`DROP TABLE IF EXISTS customers`;
    await sql`DROP TABLE IF EXISTS users`;

    console.log('Dropped all tables');
  },
};
