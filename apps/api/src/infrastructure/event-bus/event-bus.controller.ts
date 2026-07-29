import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { CreateEventBusDto } from './dto/create-event-bus.dto';
import { UpdateEventBusDto } from './dto/update-event-bus.dto';

@Controller('event-bus')
export class EventBusController {
  constructor(private readonly eventBusService: EventBusService) {}

  @Post()
  create(@Body() createEventBusDto: CreateEventBusDto) {
    return this.eventBusService.create(createEventBusDto);
  }

  @Get()
  findAll() {
    return this.eventBusService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventBusService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventBusDto: UpdateEventBusDto) {
    return this.eventBusService.update(+id, updateEventBusDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventBusService.remove(+id);
  }
}
