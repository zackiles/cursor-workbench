# "@zackiles/cursor-workbench"

[![JSR Score](https://jsr.io/badges/@zackiles/cursor-workbench/score)](https://jsr.io/@zackiles/cursor-workbench)
[![JSR](https://jsr.io/badges/@zackiles/1. Clone this repository)](https://jsr.io/@zackiles/cursor-workbench)
[![JSR Scope](https://jsr.io/badges/@zackiles)](https://jsr.io/@zackiles)
[![ci](https://github.com/zackiles/cursor-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/zackiles/cursor-workbench/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/zackiles/cursor-workbench/blob/main/LICENSE)



> [!NOTE]\
> This is a **new** project and the documentation is unlikely to be comprehensive or accurate.

## Features

- 🦖 **Modern Deno Features:** Using the latest Deno 2.
- ...

## Getting Started

1. Install @zackiles/cursor-workbench:

   ```sh
   deno add jsr:@zackiles/cursor-workbench
   ```

2. Import and use it:

   ```typescript
   import { Lib } from '@zackiles/cursor-workbench'
   import type { LibConfig, LibRequest, LibResponse } from '@zackiles/cursor-workbench'

   const config: LibConfig = { user: 'world' }
   const lib = new Lib(config)

   const data: LibRequest = { message: 'hello' }
   const response: LibResponse = await lib.read(data)

   console.log(response)
   ```

## **Changelog**

See the [`CHANGELOG`](CHANGELOG.md) for details.

## **Contributing**

See the [`CONTRIBUTING`](CONTRIBUTING.md) for details.

## **License**

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) — see the [`LICENSE`](LICENSE) for details.
