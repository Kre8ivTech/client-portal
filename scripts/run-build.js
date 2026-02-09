const { execSync } = require('child_process');

try {
  const output = execSync('npx next build --webpack', {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 180000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    }
  });
  console.log(output.toString().slice(-5000));
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed with exit code:', error.status);
  console.error('STDOUT:', error.stdout?.toString()?.slice(-5000));
  console.error('STDERR:', error.stderr?.toString()?.slice(-5000));
  process.exit(1);
}
