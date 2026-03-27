const newman = require('newman');
const { appendLog, resetLog } = require('./logger');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  gray: '\x1b[90m',
};

// Symbols with colors
const symbols = {
  success: `${colors.green}✓${colors.reset}`,
  failure: `${colors.red}✕${colors.reset}`,
  successStatus: `${colors.green}✓${colors.reset}`,
  failureStatus: `${colors.red}❌${colors.reset}`,
};

// Spinner frames
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerInterval;
let currentSpinnerFrame = 0;

function getMethodColor(method) {
  const colors = {
    GET: 'blue',
    POST: 'green',
    PUT: 'yellow',
    DELETE: 'red',
    PATCH: 'magenta',
  };
  return colors[method] || 'dim';
}

function getStatusColor(code) {
  if (code >= 200 && code < 300) return 'green';
  if (code >= 400) return 'red';
  return 'yellow';
}

function formatUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    const params = Array.from(parsed.searchParams.entries());

    if (params.length === 0) {
      return urlString;
    }

    const queryString = params
      .map(([key, value]) => `\n      ${colors.dim}${key}:${colors.reset} ${value}`)
      .join('');

    return `${parsed.origin}${parsed.pathname}${colors.dim}?${colors.reset}${queryString}`;
  } catch {
    return urlString;
  }
}

function formatContentType(contentType) {
  if (!contentType) return '';
  const mainType = contentType.split(';')[0].trim();
  switch (mainType) {
  case 'application/json':
    return `${colors.green}JSON${colors.reset}`;
  case 'text/html':
    return `${colors.yellow}HTML${colors.reset}`;
  case 'text/plain':
    return `${colors.blue}Text${colors.reset}`;
  default:
    return mainType;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDurationCategory(ms) {
  if (ms < 200) return { color: colors.green, label: 'fast' };
  if (ms < 1000) return { color: colors.yellow, label: 'medium' };
  return { color: colors.red, label: 'slow' };
}

function formatBody(body, contentType) {
  if (!body) return '';
  try {
    if (contentType && contentType.includes('json')) {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2)
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n');
    }
    if (contentType && contentType.includes('html')) {
      // For HTML, just show first 500 chars with ellipsis if needed
      const preview = body.substring(0, 500);
      return `    ${preview}${body.length > 500 ? '...' : ''}`;
    }
    return `    ${body}`;
  } catch {
    return `    ${body}`;
  }
}

function formatHeaders(headers) {
  return Object.entries(headers)
    .map(([key, value]) => {
      // Highlight important headers
      const keyColor = ['content-type', 'authorization', 'content-length'].includes(
        key.toLowerCase()
      )
        ? colors.yellow
        : colors.dim;
      return `    ${keyColor}${key}:${colors.reset} ${value}`;
    })
    .join('\n');
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatLogHeaders(headers) {
  if (!headers || Object.keys(headers).length === 0) return '(none)';

  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function formatLogBody(body, contentType) {
  if (!body) return '';

  try {
    if (contentType && contentType.includes('json')) {
      return JSON.stringify(JSON.parse(body), null, 2);
    }

    return String(body);
  } catch {
    return String(body);
  }
}

function writeLogEntry(config, lines) {
  if (!config.logPath) return;
  appendLog(`${lines.join('\n')}\n\n`);
}

function makeProgressBar(current, total, width = 20) {
  const progress = Math.floor((current / total) * width);
  const remaining = width - progress;
  const percentage = Math.floor((current / total) * 100);

  return `${colors.cyan}[${colors.green}${'█'.repeat(progress)}${colors.dim}${'░'.repeat(remaining)}${colors.cyan}]${colors.reset} ${percentage}%`;
}

function isFailedRequest(response) {
  const statusCode = parseInt(response.code);
  return statusCode >= 400;
}

function updateProgress(current, total, marks) {
  const spinner = spinnerFrames[currentSpinnerFrame];
  const progressBar = makeProgressBar(current, total);
  const progress = `${colors.cyan}${spinner} progress${colors.reset} ${progressBar} ${marks}`;
  process.stdout.write(`\r${progress}`);
}

function countRequestsInCollection(collection, folderName) {
  if (!collection || !collection.item) return 0;

  if (folderName) {
    const folder = collection.item.find((f) => f.name === folderName);
    return folder && folder.item ? folder.item.length : 0;
  }

  return collection.item.reduce((count, item) => {
    if (item.item) {
      return count + item.item.length;
    }
    return count + 1;
  }, 0);
}

function runNewman(config) {
  return new Promise((resolve, reject) => {
    const logs = [];
    let hasStartedRequests = false;
    let hasFailure = false;
    let totalRequests = countRequestsInCollection(config.collection, config.folder);
    let completedRequests = 0;
    const isDebug = config.reporter && config.reporter.cli && !config.reporter.cli.silent;
    const shouldAbortOnError = config.abortOnError !== false;
    let progressMarks = '';
    const requestTimings = new Map();
    const requestLogs = new Map();

    if (config.logPath) {
      resetLog();
    }

    newman
      .run(config)
      .on('start', (err) => {
        if (err) return;
        console.log(
          `${colors.cyan}${colors.bold}thanks for asking nicely! i'll be just a second${colors.reset}`
        );
        updateProgress(0, totalRequests, '');

        // Start spinner
        spinnerInterval = setInterval(() => {
          currentSpinnerFrame = (currentSpinnerFrame + 1) % spinnerFrames.length;
          updateProgress(completedRequests, totalRequests, progressMarks);
        }, 80);
      })
      .on('beforeRequest', (err, args) => {
        if (err) return;

        if (hasFailure && shouldAbortOnError) return;

        // Record start time
        requestTimings.set(args.item.name, Date.now());
        const { request } = args;
        const headerMembers = request.headers ? request.headers.members : {};
        const requestHeaders = formatLogHeaders(headerMembers);
        const contentType = request.headers ? request.headers.get('Content-Type') : undefined;
        const requestBody =
          request.body && request.body.raw
            ? formatLogBody(request.body.raw, contentType)
            : '';

        requestLogs.set(args.item.name, {
          timestamp: new Date().toISOString(),
          method: request.method,
          url: request.url.toString(),
          headers: requestHeaders,
          contentType,
          body: requestBody,
        });

        if (!hasStartedRequests) {
          hasStartedRequests = true;
          logs.push('');
        }
        logs.push(`\n${colors.dim}${args.item.name}${colors.reset}`);

        if (isDebug) {
          const { request } = args;
          const methodColor = colors[getMethodColor(request.method)];

          // Request section
          logs.push(`  ${colors.bold}Request:${colors.reset}`);
          logs.push(
            `    ${methodColor}${request.method}${colors.reset} ${formatUrl(request.url.toString())}`
          );

          // Headers section if present
          const headers = request.headers.members;
          if (Object.keys(headers).length > 0) {
            logs.push(`    ${colors.bold}Headers:${colors.reset}`);
            logs.push(formatHeaders(headers));
          }

          // Body section if present
          if (request.body && request.body.raw) {
            const contentType = request.headers.get('Content-Type');
            logs.push(`    ${colors.bold}Body:${colors.reset} (${formatContentType(contentType)})`);
            logs.push(formatBody(request.body.raw, contentType));
          }
        }
      })
      .on('request', (err, args) => {
        if (hasFailure && shouldAbortOnError) return;

        if (err) {
          hasFailure = true;
          completedRequests++;
          progressMarks += symbols.failure;
          updateProgress(completedRequests, totalRequests, progressMarks);

          logs.push(`  ${colors.red}Error: ${err.message}${colors.reset}`);
          const requestLog = requestLogs.get(args.item.name) || {};
          const duration = requestTimings.has(args.item.name)
            ? Date.now() - requestTimings.get(args.item.name)
            : 0;
          writeLogEntry(config, [
            `Request: ${args.item.name}`,
            `Timestamp: ${requestLog.timestamp || new Date().toISOString()}`,
            `Method: ${requestLog.method || 'unknown'}`,
            `URL: ${requestLog.url || 'unknown'}`,
            'Request Headers:',
            requestLog.headers || '(none)',
            ...(requestLog.body ? ['Request Body:', requestLog.body] : []),
            `Runtime Error: ${err.message}`,
            `Duration: ${formatDuration(duration)}`,
          ]);

          if (shouldAbortOnError) {
            logs.push(
              `  ${colors.red}Aborting flow due to request error. Use --continue-on-error to override.${colors.reset}`
            );
          }
          return;
        }

        completedRequests++;
        const { response } = args;
        const duration = Date.now() - requestTimings.get(args.item.name);
        const durationCat = getDurationCategory(duration);
        const requestLog = requestLogs.get(args.item.name) || {};

        if (response.code) {
          const failed = isFailedRequest(response);
          if (failed) hasFailure = true;
          progressMarks += failed ? symbols.failure : symbols.success;
          updateProgress(completedRequests, totalRequests, progressMarks);

          const statusColor = colors[getStatusColor(response.code)];
          const durationText = `${durationCat.color}${formatDuration(duration)} (${durationCat.label})${colors.reset}`;
          const statusLog = `  ${colors.bold}Status:${colors.reset} ${statusColor}${response.code} ${response.status}${colors.reset}`;
          logs.push(
            `${statusLog} ${failed ? symbols.failureStatus : symbols.successStatus} ${durationText}`
          );

          if (failed) {
            if (shouldAbortOnError) {
              logs.push(
                `  ${colors.red}Aborting flow due to request failure. Use --continue-on-error to override.${colors.reset}`
              );
            }
          }

          if (isDebug) {
            // Response headers section
            const headers = response.headers.members;
            if (Object.keys(headers).length > 0) {
              logs.push(`  ${colors.bold}Response Headers:${colors.reset}`);
              logs.push(formatHeaders(headers));
            }

            // Response body section
            if (response.stream) {
              const contentType = response.headers.get('content-type');
              const body = response.stream.toString();
              const size = Buffer.from(body).length;

              logs.push(
                `  ${colors.bold}Response Body:${colors.reset} (${formatContentType(contentType)}, ${formatSize(size)})`
              );
              logs.push(formatBody(body, contentType));

              // If it's a failed request, add extra debug info
              if (failed) {
                logs.push(`  ${colors.bold}Debug Info:${colors.reset}`);
                logs.push(`    ${colors.dim}Response Size:${colors.reset} ${formatSize(size)}`);
                logs.push(
                  `    ${colors.dim}Content-Type:${colors.reset} ${formatContentType(contentType)}`
                );
                logs.push(`    ${colors.dim}Response Time:${colors.reset} ${durationText}`);

                // Try to parse error details from response
                try {
                  const parsed = JSON.parse(body);
                  if (parsed.error || parsed.message || parsed.details) {
                    logs.push(`    ${colors.dim}Error Details:${colors.reset}`);
                    if (parsed.error)
                      logs.push(`      ${colors.red}Error:${colors.reset} ${parsed.error}`);
                    if (parsed.message)
                      logs.push(`      ${colors.red}Message:${colors.reset} ${parsed.message}`);
                    if (parsed.details)
                      logs.push(
                        `      ${colors.red}Details:${colors.reset} ${JSON.stringify(parsed.details, null, 2)}`
                      );
                  }
                } catch {
                  // Ignore JSON parse errors for non-JSON responses
                }
              }
            }
          }

          const responseHeaders = response.headers ? response.headers.members : {};
          const responseContentType = response.headers ? response.headers.get('content-type') : '';
          const responseBody = response.stream
            ? formatLogBody(response.stream.toString(), responseContentType)
            : '';

          writeLogEntry(config, [
            `Request: ${args.item.name}`,
            `Timestamp: ${requestLog.timestamp || new Date().toISOString()}`,
            `Method: ${requestLog.method || args.request.method}`,
            `URL: ${requestLog.url || args.request.url.toString()}`,
            'Request Headers:',
            requestLog.headers || '(none)',
            ...(requestLog.body ? ['Request Body:', requestLog.body] : []),
            `Response Status: ${response.code} ${response.status}`,
            'Response Headers:',
            formatLogHeaders(responseHeaders),
            ...(responseBody ? ['Response Body:', responseBody] : []),
            `Duration: ${formatDuration(duration)}`,
          ]);
        }
      })
      .on('console', (err, args) => {
        if (!err && args.messages && args.messages.length > 0) {
          logs.push(
            ...args.messages.map((msg) => `  ${colors.bold}Console:${colors.reset} ${msg}`)
          );
        }
      })
      .on('done', (err, summary) => {
        // Clear spinner interval
        clearInterval(spinnerInterval);

        if (err || summary.error) {
          console.error(`\n${colors.red}womp womp :( an error occurred${colors.reset}`);
          reject(err || summary.error);
          return;
        }

        // Add newline after progress
        console.log('\n');

        // Show summary line
        const failedCount = progressMarks.split(symbols.failure).length - 1;
        const duration = summary.run.timings.completed - summary.run.timings.started;

        if (hasFailure) {
          console.log(
            `${colors.red}completed with ${failedCount} failed request${failedCount > 1 ? 's' : ''} ${colors.dim}in ${formatDuration(duration)}${colors.reset}\n`
          );
        } else {
          console.log(
            `${colors.green}all done! everything passed ${colors.dim}in ${formatDuration(duration)}${colors.reset}\n`
          );
        }

        // Show detailed logs
        if (logs.length > 0) {
          logs.forEach((log) => console.log(log));
        }

        if (isDebug && summary.run && summary.run.stats) {
          const stats = summary.run.stats;
          console.log(`\n${colors.bold}Run Summary:${colors.reset}`);
          console.log(`  ${colors.dim}Total Requests:${colors.reset} ${stats.requests.total}`);
          console.log(
            `  ${colors.dim}Failed Requests:${colors.reset} ${stats.requests.failed > 0 ? colors.red : colors.green}${stats.requests.failed}${colors.reset}`
          );
          console.log(`  ${colors.dim}Total Tests:${colors.reset} ${stats.tests.total}`);
          console.log(
            `  ${colors.dim}Failed Tests:${colors.reset} ${stats.tests.failed > 0 ? colors.red : colors.green}${stats.tests.failed}${colors.reset}`
          );
          console.log(`  ${colors.dim}Total Time:${colors.reset} ${formatDuration(duration)}`);
        }

        if (hasFailure && shouldAbortOnError) {
          reject(new Error('Flow failed due to request error'));
          return;
        }

        resolve();
      });
  });
}

module.exports = { runNewman };
