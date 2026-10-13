import { apiRequest } from './queryClient';
export async function createAndSubmitReport(data: unknown, request = apiRequest) {
  const created = await request('POST','/api/reports',data);
  const report = await created.json();
  if (!report?.id) throw new Error('The report could not be created. Please try again.');
  const submitted = await request('POST',`/api/reports/${report.id}/submit`,{});
  return submitted.json();
}
