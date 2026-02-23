import { ChatOpenAI } from '@langchain/openai';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { Injectable, Logger } from '@nestjs/common';
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
  private lastFlightResult: BaseResponse | null = null;
  private readonly logger = new Logger(ChatService.name);
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
    this.lastFlightResult = null;
    this.logger.debug(`chat() called with ${messages.length} message(s)`);

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
        this.logger.debug(
          `search_flights tool invoked: ${JSON.stringify(params)}`,
        );
        const result = await this.flightSearchService.searchFlight(params);
        const bestCount = Array.isArray(result?.best_flights)
          ? result.best_flights.length
          : 0;
        const otherCount = Array.isArray(result?.other_flights)
          ? result.other_flights.length
          : 0;
        this.logger.debug(
          `search_flights result: ${bestCount} best, ${otherCount} other`,
        );

        // When results are empty, return a structured hint so the agent retries
        // rather than concluding there are no flights on the route.
        if (bestCount + otherCount === 0) {
          return JSON.stringify({
            no_results: true,
            searched: params,
            hint:
              `No flights returned for ${params.departure_id}→${params.arrival_id} on ${params.outbound_date}. ` +
              `SerpAPI often returns empty results for dates within 7 days. ` +
              `REQUIRED: call search_flights again with outbound_date at least 7 days from today (${today}), ` +
              `OR try an alternative departure airport (e.g. EWR or LGA for New York, ` +
              `LGW or STN for London). Do NOT tell the user there are no flights yet.`,
          });
        }

        await this.priceHistoryService.saveSearch(params, result);
        this.lastFlightResult = result;
        return JSON.stringify(result);
      },
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are a helpful, accurate flight search assistant powered by real-time Google Flights data.

## Date rules (today is ${today}, ${new Date().toLocaleDateString('en-US', { weekday: 'long' })})
- Always use YYYY-MM-DD. Never use past dates.
- "This weekend" = the immediately upcoming Saturday. If today IS Saturday, use today.
- "Next weekend" = the Saturday that is 7–14 days from today (never within 6 days).
- Example: if today is Sunday Feb 22, "next weekend" = Saturday Feb 28.
- "Next [weekday]" = the first occurrence of that weekday that is at least 1 day away.
- For vague requests (e.g. "March"), use a specific date ~3–4 weeks out.

## Airport fallbacks (try in order if no results)
- New York City: JFK → EWR → LGA
- London: LHR → LGW → STN → LCY
- Paris: CDG → ORY
- Chicago: ORD → MDW
- Los Angeles: LAX → BUR
- San Francisco: SFO → OAK
- Washington DC: DCA → IAD → BWI
- Miami: MIA → FLL
- Boston: BOS → ORH

## Retry strategy (CRITICAL — follow this every time)
If search_flights returns {{ no_results: true }}:
1. Do NOT tell the user there are no flights — major routes always have flights.
2. First retry: use the SAME airports with outbound_date moved to at least 7 days from today.
3. Second retry: keep the new date but switch to the next airport in the fallback list above.
4. Only after 2 failed retries may you tell the user results are temporarily unavailable.
5. You have up to 5 tool calls — use them for retries.

## Response format (strict)
The frontend automatically renders rich flight cards for every result — airline logo, times, dates, duration, stops, price, CO₂. You MUST NOT repeat that information in your text reply.

Your text response should be 1–2 sentences maximum:
- Say what you found at a high level (route, date, number of options, price range).
- You may highlight ONE noteworthy fact (e.g. cheapest option, a nonstop deal).
- Do NOT list individual flights, airlines, times, prices, or durations in your text.

Good example: "Found 8 flights from JFK to LHR on Feb 28 — prices start at $285. Several nonstop options available."
Bad example: "1. British Airways departs 08:05, arrives 20:00, 6h 55m, $285. 2. Delta departs 20:00…"

For follow-up refinements (e.g. "only direct", "different date"), call the tool again with updated parameters and apply the same concise format.`,
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
      maxIterations: 8,
    });

    const { input, chat_history } = this.toAgentInput(messages);
    this.logger.debug(
      `agent input: "${input.slice(0, 80)}${input.length > 80 ? '...' : ''}", history length: ${chat_history.length}`,
    );
    const result = await executor.invoke({
      input,
      chat_history,
    });

    const message =
      typeof result.output === 'string'
        ? result.output
        : ((result.output as { output?: string })?.output ??
          'I could not complete your request.');

    this.logger.debug(
      `chat() completed, response length: ${message.length}, hasFlightResults: ${this.lastFlightResult !== null}`,
    );
    return {
      message,
      flightResults: this.lastFlightResult ?? null,
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
