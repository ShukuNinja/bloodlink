# BloodLink

BloodLink is a hospital-centered blood coordination platform that connects
hospitals with authorized blood centres and potential voluntary donors through
hospital-verified blood requests, location-aware matching, tiered notifications,
donor networks, and structured coordination.

## Architecture

BloodLink is an Internet-dependent multi-client platform.

- Web: Next.js + TypeScript
- Mobile: React Native + Expo + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma + PostGIS

Both web and mobile clients communicate with the same backend API.

## Repository Structure

```text
apps/
├── api/
├── web/
└── mobile/

packages/
├── contracts/
├── validation/
├── ui/
└── config/

prisma/
docs/