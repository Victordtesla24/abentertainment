import { tool } from 'ai';
import { z } from 'zod';

const t = tool({
  description: 'Desc',
  parameters: z.object({ title: z.string() }),
  execute: async ({ title }) => {
    return title;
  }
});
