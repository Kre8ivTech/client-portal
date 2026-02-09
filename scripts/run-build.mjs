import { execSync } from 'child_process';

try {
  // Run the build without the migrate step (build:local)
  const output = execSync('npx next build --webpack', {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 120000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    }
  });
  console.log(output.toString());
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed with exit code:', error.status);
  console.error('STDOUT:', error.stdout?.toString()?.slice(-3000));
  console.error('STDERR:', error.stderr?.toString()?.slice(-3000));
  process.exit(1);
}
