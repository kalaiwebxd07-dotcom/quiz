-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Questions Table
create table questions (
  id uuid default uuid_generate_v4() primary key,
  question text not null,
  options jsonb not null, -- Stores { "A": "...", "B": "..." }
  answer text not null, -- Stores "A", "B", "C", or "D"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Results Table
create table results (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  score integer not null,
  total integer not null,
  percentage numeric(5,2) not null,
  date text not null, -- Storing as text to match existing format (YYYY-MM-DD)
  time text not null, -- Storing as text (HH:MM:SS)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Settings Table (Key-Value store)
create table settings (
  key text primary key,
  value jsonb not null
);

-- Insert default settings
insert into settings (key, value) values ('quiz_duration', '{"duration": 10}');

-- Insert default questions
insert into questions (question, options, answer) values
('Which keyword is used to create a class in Java?', '{"A": "class", "B": "new", "C": "object", "D": "create"}', 'A'),
('What is the entry point method of a Java program?', '{"A": "start()", "B": "run()", "C": "main()", "D": "init()"}', 'C'),
('What is the size of int in Java (in bits)?', '{"A": "8", "B": "16", "C": "32", "D": "64"}', 'C'),
('Which of the following is NOT a primitive data type in Java?', '{"A": "int", "B": "float", "C": "String", "D": "boolean"}', 'C'),
('Which keyword is used to create an object in Java?', '{"A": "class", "B": "new", "C": "this", "D": "object"}', 'B');

-- Tests Table (for Test Manager)
create table if not exists tests (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  duration integer default 10, -- in minutes
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  max_attempts integer default 0, -- 0 = unlimited
  shuffle_questions boolean default true,
  show_results boolean default true,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add test_id column to questions (optional, for linking)
alter table questions add column if not exists test_id uuid references tests(id);

-- Students Table
create table if not exists students (
  roll_number text primary key,
  name text not null,
  password text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add roll_number to results
alter table results add column if not exists roll_number text;

-- Insert default test
insert into tests (name, description, duration, is_active)
values ('Java MCQ Quiz', 'Test your Java programming knowledge', 10, true)
on conflict do nothing;
