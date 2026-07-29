import { Injectable } from '@nestjs/common';
import { CreateEventBusDto } from './dto/create-event-bus.dto';
import { UpdateEventBusDto } from './dto/update-event-bus.dto';

@Injectable()
export class EventBusService {
  create(createEventBusDto: CreateEventBusDto) {
    return 'This action adds a new eventBus';
  }

  findAll() {
    return `This action returns all eventBus`;
  }

  findOne(id: number) {
    return `This action returns a #${id} eventBus`;
  }

  update(id: number, updateEventBusDto: UpdateEventBusDto) {
    return `This action updates a #${id} eventBus`;
  }

  remove(id: number) {
    return `This action removes a #${id} eventBus`;
  }
}
