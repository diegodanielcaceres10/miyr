import * as ciWorkflow from './ci-workflow.mjs';
import * as editorconfig from './editorconfig.mjs';
import * as license from './license.mjs';
import * as packageScripts from './package-scripts.mjs';
import * as readme from './readme.mjs';

// Checks that apply to any project, whatever its stack. Register new ones here.
export const checks = [packageScripts, editorconfig, readme, license, ciWorkflow];
