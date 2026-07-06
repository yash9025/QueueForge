// A simple sleep function to simulate work
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type JobHandler = (payload: any) => Promise<void>;

// The Handler Registry maps a job 'type' string to the actual function that executes it
export const registry: Record<string, JobHandler> = {
  
  welcome_email: async (payload: { user_id: number; email: string }) => {
    console.log(`[HANDLER] ✉️ Sending welcome email to ${payload.email}...`);
    await sleep(2000); // Simulate network delay
    console.log(`[HANDLER] ✅ Welcome email sent successfully to ${payload.email}`);
  },

  password_reset: async (payload: { user_id: number; email: string }) => {
    console.log(`[HANDLER] 🔐 Processing password reset for ${payload.email}...`);
    await sleep(1500); // Simulate network delay
    console.log(`[HANDLER] ✅ Password reset link generated and sent to ${payload.email}`);
  },

  failing_job: async (payload: any) => {
    console.log(`[HANDLER] 💥 Running a job destined to fail...`);
    await sleep(500);
    throw new Error('This is a simulated failure to test retry and dead-letter logic');
  }
};
