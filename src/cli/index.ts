#!/usr/bin/env node

/**
 * antikarlotta CLI — bidirectional Figma-code sync.
 */

import { config } from "dotenv";
config(); // loads .env from cwd

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { diffCommand } from "./commands/diff.js";
import { commitCommand } from "./commands/commit.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";
import { stageCommand } from "./commands/stage.js";
import { resolveCommand } from "./commands/resolve.js";
import { tokensCommand } from "./commands/tokens.js";

const program = new Command()
  .name("antikarlotta")
  .description("Bidirectional Figma-code sync with a canonical component schema")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(statusCommand);
program.addCommand(diffCommand);
program.addCommand(stageCommand);
program.addCommand(commitCommand);
program.addCommand(pullCommand);
program.addCommand(pushCommand);
program.addCommand(resolveCommand);
program.addCommand(tokensCommand);

program.parse();
