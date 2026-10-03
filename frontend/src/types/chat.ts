export interface Chat {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface FunctionCall {
  id?: string;
  name: string;
  arguments_json: string;
}

export interface FunctionResult {
  id?: string;
  name: string;
  result_json: string;
  is_error?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "USER" | "MODEL" | "TOOL";
  text?: string;
  function_calls?: FunctionCall[];
  function_results?: FunctionResult[];
  created_at?: string;
}