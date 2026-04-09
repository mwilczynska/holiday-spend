import { error, handleError, success } from '@/lib/api-helpers';
import { getPlannerGroupSize, setPlannerGroupSize } from '@/lib/planner-settings';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  groupSize: z.number().int().min(1).max(5),
});

export async function GET() {
  try {
    const groupSize = await getPlannerGroupSize();
    return success({ groupSize });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    const groupSize = await setPlannerGroupSize(data.groupSize);
    return success({ groupSize });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error(err.issues.map((issue) => issue.message).join(', '), 400);
    }
    return handleError(err);
  }
}
