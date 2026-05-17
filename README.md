# GPA Insights

A web application for visualizing and tracking your cumulative GPA across semesters with beautiful, interactive charts.

## Features

- 📊 Interactive GPA visualization with grade band overlays
- 🔐 Google OAuth authentication
- 💾 Persistent data storage for your academic progress
- 📈 Dynamic statistics (starting GPA, current GPA, growth)
- 🎨 Clean, elegant design with custom styling
- 📱 Responsive and mobile-friendly

## Tech Stack

- **Frontend**: React + Vite
- **Styling**: CSS Modules
- **Charts**: Chart.js with react-chartjs-2
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Google OAuth
- **Deployment**: Vercel

## Database Schema

### Overview
The application uses Supabase (PostgreSQL) for data storage with Row Level Security (RLS) enabled to ensure users can only access their own data.

### Tables

#### `semesters`
Stores semester-level GPA data for each user.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to auth.users (Supabase Auth) |
| `semester_code` | TEXT | Semester identifier (e.g., "1.1", "2.2") |
| `semester_label` | TEXT | Display label (e.g., "Y1 S1", "Y2 S2") |
| `gpa` | DECIMAL | Cumulative GPA value (0.0 - 5.0) |
| `note` | TEXT | Optional note (e.g., "Exchange / Internship") |
| `is_special` | BOOLEAN | Flag for exchange/internship semesters |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp (auto-updated) |

**Constraints:**
- `gpa` must be between 0.0 and 5.0
- Unique constraint on (`user_id`, `semester_code`) - prevents duplicate semesters
- Cascade delete on user deletion

**Indexes:**
- `idx_semesters_user_id` on `user_id` for faster queries

#### `user_settings`
Stores user preferences and settings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `user_id` | UUID | Foreign key to auth.users (unique per user) |
| `grade_scale` | DECIMAL | Preferred grade scale (4.0 or 5.0) |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp (auto-updated) |

**Constraints:**
- `grade_scale` must be either 4.0 or 5.0
- One settings record per user (unique `user_id`)
- Cascade delete on user deletion

**Indexes:**
- `idx_user_settings_user_id` on `user_id` for faster queries

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**`semesters` policies:**
- Users can SELECT their own semester records
- Users can INSERT new semester records for themselves
- Users can UPDATE their own semester records
- Users can DELETE their own semester records

**`user_settings` policies:**
- Users can SELECT their own settings
- Users can INSERT their own settings
- Users can UPDATE their own settings

**Security Model:**
- Authentication handled by Supabase Auth (`auth.users` table)
- `auth.uid()` function ensures users only access their own data
- No user can read or modify another user's data

### Triggers

**`update_updated_at_column()`**
- Automatically updates the `updated_at` timestamp on any UPDATE operation
- Applied to both `semesters` and `user_settings` tables

## Setup

### Prerequisites
- Node.js 20.19+ or 22.12+
- Supabase account
- Google Cloud Console account (for OAuth)

### Environment Variables

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development Roadmap

- **Iter 1**: ✅ Static GPA visualization
- **Iter 2**: 🚧 User authentication and data persistence
- **Iter 3**: 📋 Transcript upload and parsing (SMU)
- **Iter 4**: 🤖 AI-powered personalized insights

## License

ISC