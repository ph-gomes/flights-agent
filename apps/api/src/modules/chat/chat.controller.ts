import { Body, Controller, Post } from '@nestjs/common';
import { ChatService, type ChatMessage } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  chat(@Body() body: { messages: ChatMessage[] }) {
    if (!Array.isArray(body?.messages)) {
      return {
        message: 'Please provide a messages array.',
        flightResults: null,
      };
    }
    return this.chatService.chat(body.messages);
  }
}
