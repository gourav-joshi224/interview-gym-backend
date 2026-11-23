import { Level } from '../../../domain/levels';

/**
 * Classic interview angles for one subtopic, by level. They are starting points for the question
 * writer, based on the questions interviewers keep asking, so sessions stay grounded in real interviews
 * instead of whatever the model happens to invent. The writer rephrases and varies them.
 */
export type SubtopicAnchors = Record<Level, string[]>;

export type AnchorMap = Record<string, SubtopicAnchors>;
