/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface Quiz {
  title: string;
  questions: Question[];
}

export type AppState = 'landing' | 'loading' | 'quiz' | 'results';

export interface FileData {
  data: string; // base64
  mimeType: string;
  name: string;
}
