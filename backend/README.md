# GMAT Quiz Backend

Backend server for the GMAT Quiz application with MongoDB integration and OpenAI API functionality.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example` and add your environment variables:
```bash
cp .env.example .env
```

3. Update the `.env` file with your specific values, including the OpenAI API key.

## Running the Application

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Run in production mode
npm start
```

## Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm test` - Run tests

### Data Management Scripts

- `npm run create-test-user` - Create a test user account
- `npm run create-sample-questions` - Generate sample questions
- `npm run create-sample-quiz` - Create a sample quiz
- `npm run add-critical-reasoning` - Add critical reasoning questions
- `npm run process-pdfs` - Import questions from PDF files

### AI Integration Scripts

- `npm run generate-ai-answers` - Generate AI-enhanced answers for all questions

## AI Answer Generation

The backend includes functionality to enhance question data using OpenAI's o4-mini API. This feature:

1. Fetches all questions from the database
2. Processes them through OpenAI to get:
   - AI-generated correct answers
   - Brief explanations (under 80 words)
   - Difficulty ratings (1.0-10.0 scale)
3. Updates the database with the enhanced data

### Optimization Features

The AI answer generation is optimized for cost efficiency through:

- **Concurrency limiting** - Controls the number of simultaneous requests to avoid rate limits
- **Request batching** - Groups multiple questions in single API calls to reduce overhead
- **Response caching** - Avoids duplicate processing of identical questions
- **Prompt optimization** - Uses minimal prompts to reduce token usage
- **Error handling** - Gracefully retries on transient failures and skips problematic questions
- **Detailed logging** - Tracks processing statistics and estimated API costs

### Usage

To run the AI answer generation script:

```bash
npm run generate-ai-answers
```

Make sure you have set the `OPENAI_API_KEY` in your `.env` file before running the script.

## API Documentation

[API endpoints documentation to be added] 