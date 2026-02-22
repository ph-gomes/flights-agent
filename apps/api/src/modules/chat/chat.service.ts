import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BaseResponse } from 'serpapi';
import { FlightSearchService } from '../flight-search/flight-search.service';
import { PriceHistoryService } from '../price-history/price-history.service';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  flightResults: BaseResponse | null;
}

@Injectable()
export class ChatService {
  private openaiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly flightSearchService: FlightSearchService,
    private readonly priceHistoryService: PriceHistoryService,
  ) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.openaiKey = openaiKey;
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    let lastFlightResult: BaseResponse | null = null;

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD for date resolution
    const searchFlightsTool = new DynamicStructuredTool({
      name: 'search_flights',
      description: `Search for flights using Google Flights. Use IATA 3-letter airport codes (e.g. JFK, CDG, LHR) for departure_id and arrival_id. Dates in YYYY-MM-DD; outbound_date must be today or in the future (today is ${today}). type: 1 = round trip, 2 = one way.`,
      schema: z.object({
        departure_id: z
          .string()
          .describe('Departure airport IATA code (e.g. JFK, LGA) or city'),
        arrival_id: z
          .string()
          .describe('Arrival airport IATA code (e.g. CDG, ORY) or city'),
        outbound_date: z.string().describe('Outbound date YYYY-MM-DD'),
        return_date: z
          .string()
          .optional()
          .describe('Return date YYYY-MM-DD for round trips'),
        type: z
          .number()
          .optional()
          .describe('1 = round trip, 2 = one way. Default 2'),
      }),
      func: async (args) => {
        const params = {
          departure_id: args.departure_id,
          arrival_id: args.arrival_id,
          outbound_date: args.outbound_date,
          return_date: args.return_date ?? undefined,
          type: args.type ?? 2,
        };
        const result = await this.flightSearchService.searchFlight(params);
        await this.priceHistoryService.saveSearch(params, result);
        lastFlightResult = result;
        return JSON.stringify(result);
      },
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a helpful flight search assistant. Use the search_flights tool to find real-time flight options from Google Flights. When the user asks for flights, call the tool with IATA airport codes and dates (YYYY-MM-DD). Today is ${today}—always use today or future dates (e.g. "this weekend" = upcoming Saturday/Sunday, "next weekend" = the following one). Summarize the results clearly with airlines, prices, and times. For follow-up requests (e.g. "only direct" or "Friday instead"), call the tool again with the refined parameters.`,
      ],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0,
      openAIApiKey: this.openaiKey,
    });

    const agent = createToolCallingAgent({
      llm,
      tools: [searchFlightsTool],
      prompt,
    });

    const executor = new AgentExecutor({
      agent,
      tools: [searchFlightsTool],
      returnIntermediateSteps: false,
      maxIterations: 5,
    });

    const { input, chat_history } = this.toAgentInput(messages);
    const result = await executor.invoke({
      input,
      chat_history,
    });

    const message =
      typeof result.output === 'string'
        ? result.output
        : ((result.output as { output?: string })?.output ??
          'I could not complete your request.');

    return {
      message,
      flightResults: lastFlightResult ?? null,
    };
  }

  private toAgentInput(messages: ChatMessage[]): {
    input: string;
    chat_history: (HumanMessage | AIMessage)[];
  } {
    const history: (HumanMessage | AIMessage)[] = [];
    let lastInput = '';
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'user') {
        lastInput = m.content;
        history.push(new HumanMessage(m.content));
      } else if (m.role === 'assistant') {
        history.push(new AIMessage(m.content));
      }
    }
    if (
      lastInput &&
      history.length > 0 &&
      history[history.length - 1] instanceof HumanMessage
    ) {
      history.pop();
    }
    return {
      input:
        lastInput || (messages.find((m) => m.role === 'user')?.content ?? ''),
      chat_history: history,
    };
  }
}
