import {
  Body,
  Controller,
  Post,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ChatService, type ChatMessage } from './chat.service';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: { messages: ChatMessage[] }) {
    const { messages } = body ?? {};
    if (!Array.isArray(messages)) {
      return {
        message: 'Please provide a messages array.',
        flightResults: null,
      };
    }
    try {
      return await this.chatService.chat(messages);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Chat request failed';
      this.logger.warn(
        `Chat error: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new HttpException(
        { message, error: 'Internal Server Error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
