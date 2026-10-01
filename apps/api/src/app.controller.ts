import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  getRoot() {
    return { name: 'RASD API', version: '1.0.0', status: 'online' };
  }
}
