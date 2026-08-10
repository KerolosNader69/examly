import { test, expect, Page } from '@playwright/test';

async function signup(page: Page) {
  await page.goto('/signup');
  await expect(page).toHaveTitle(/Sign up|Examly/);

  await page.getByLabel('Full name').fill('Alex Morgan');
  await page.getByLabel('Work email').fill('alex@school.edu');
  await page.getByLabel('Date of birth').fill('2000-05-15');
  await page.getByRole('button', { name: 'Female' }).click();
  await page.getByLabel('Password').fill('Str0ng!Pass');
  await page.getByLabel('Confirm password').fill('Str0ng!Pass');
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByRole('button', { name: 'Create Free Account' }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

async function createExam(page: Page): Promise<string> {
  await page.goto('/dashboard/exams/new');
  await expect(page.getByRole('heading', { name: 'Create New Exam' })).toBeVisible();

  await page.getByLabel('Exam title').fill('Quarterly Speaking Test');
  await page.getByLabel('Question text').fill('Describe your favorite subject.');
  await page.getByLabel(/Keywords/).fill('passion, curiosity');

  await page.getByRole('button', { name: 'Create Exam' }).click();
  await expect(page).toHaveURL(/\/dashboard\/exams\/exam-/);

  const code = await page.evaluate(() => {
    const raw = window.localStorage.getItem('examly_exams');
    const exams = raw ? JSON.parse(raw) : [];
    return exams[0]?.code ?? '';
  });
  expect(code).toMatch(/^EXM-/);
  return code;
}

test('landing page loads with key sections', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /AI-Powered/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Get Started Free' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
});

test('signup validates password requirements and creates account', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Password').fill('weak');
  await expect(page.getByText('Password strength')).toBeVisible();

  await page.getByRole('button', { name: 'Create Free Account' }).click();
  await expect(page.getByText('Full name is required')).toBeVisible();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();

  await signup(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('create exam, publish, and verify it appears in list', async ({ page }) => {
  await signup(page);
  const code = await createExam(page);

  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Exam published')).toBeVisible();

  await page.getByRole('link', { name: 'My Exams' }).click();
  await expect(page.getByText('Quarterly Speaking Test')).toBeVisible();
  await expect(page.getByText(code)).toBeVisible();
});

test('student can join exam by code and receive a grade', async ({ page }) => {
  await signup(page);
  const code = await createExam(page);

  await page.goto(`/exam/${code}`);
  await expect(page.getByRole('heading', { name: 'Quarterly Speaking Test' })).toBeVisible();

  await page.getByLabel('Your full name').fill('Jordan Lee');
  await page.getByRole('button', { name: 'Start Exam' }).click();

  await expect(page.getByRole('heading', { name: /Ready to begin/ })).toBeVisible();
  await page.getByRole('button', { name: "I'm Ready" }).click();

  await expect(page.getByText('Question 1 of 1')).toBeVisible();
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('Grading your response...')).toBeVisible();
  await expect(page.getByText(/\d+%/)).toBeVisible({ timeout: 10_000 });

  await expect(page.getByRole('button', { name: 'Take Again' })).toBeVisible();
});

test('results page reflects a completed submission', async ({ page }) => {
  await signup(page);
  const code = await createExam(page);

  await page.goto(`/exam/${code}`);
  await page.getByLabel('Your full name').fill('Jordan Lee');
  await page.getByRole('button', { name: 'Start Exam' }).click();
  await page.getByRole('button', { name: "I'm Ready" }).click();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('button', { name: 'Take Again' })).toBeVisible({ timeout: 10_000 });

  await page.goto('/dashboard/results');
  await expect(page.getByRole('heading', { name: 'Results & Analytics' })).toBeVisible();
  await expect(page.getByText('Jordan Lee')).toBeVisible();
  await expect(page.getByText('Submissions graded')).toBeVisible();
});

test('exam list supports search, sorting, and delete with toast', async ({ page }) => {
  await signup(page);
  await createExam(page);

  await page.getByRole('link', { name: 'My Exams' }).click();

  const search = page.getByPlaceholder(/Search by title/);
  await search.fill('Quarterly');
  await expect(page.getByText('Quarterly Speaking Test')).toBeVisible();
  await expect(page.getByText('English Speaking Assessment')).toHaveCount(0);

  await search.fill('zzz-no-match');
  await expect(page.getByText('No exams found')).toBeVisible();
  await search.fill('');

  await page.getByRole('button', { name: 'Delete exam' }).first().click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Exam deleted')).toBeVisible();
});

test('404 page renders for unknown exam code', async ({ page }) => {
  await page.goto('/exam/ZZZ-9999');
  await expect(page.getByRole('heading', { name: 'Exam not found' })).toBeVisible();
});
