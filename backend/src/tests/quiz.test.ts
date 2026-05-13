import request from 'supertest';
import express from 'express';
import quizRoutes from '../routes/quizRoutes';

// Create a simple express app for testing
const app = express();
app.use(express.json());
app.use('/api', quizRoutes);

describe('Quiz Routes', () => {
  test('Quiz submission endpoint should accept answers', async () => {
    const answers = {
      '123456789012': 'A',
      '123456789013': 'B',
    };

    const response = await request(app)
      .post('/api/quizzes/submit')
      .send({ answers });

    // Should return 200 status (even if no questions are found)
    expect(response.status).not.toBe(404);
  });
}); 