import type OpenAI from 'openai'

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_videos',
      description: 'Search videos in the StreamHub database by keyword and filters. Returns up to `limit` matching rows.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Full-text keyword query' },
          sort: { type: 'string', enum: ['newest', 'popular', 'relevant'], default: 'relevant' },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_recommendations',
      description: 'Personalized video recommendations for a user, drawn from their watch history and subscriptions.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User UUID' },
          content_type: { type: 'string', enum: ['video', 'short', 'live'], default: 'video' },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 }
        },
        required: ['user_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'moderate_comment',
      description: 'Evaluate a comment for policy violations (hate, harassment, spam, NSFW). Flags or approves the comment and persists the decision.',
      parameters: {
        type: 'object',
        properties: {
          comment_id: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['comment_id', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_tags',
      description: 'Return 5-12 concise, lowercase, hyphenated tag suggestions for a video based on its title and description.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_trending',
      description: 'Return currently trending videos ordered by a weighted score of views, likes and recency.',
      parameters: {
        type: 'object',
        properties: {
          window_hours: { type: 'integer', minimum: 1, maximum: 168, default: 48 },
          limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 }
        }
      }
    }
  }
]

export type ToolName =
  | 'search_videos'
  | 'get_recommendations'
  | 'moderate_comment'
  | 'suggest_tags'
  | 'get_trending'
