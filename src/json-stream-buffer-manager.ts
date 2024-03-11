import { ParserValueType } from "./json-stream-transformer";
import { EventEmitter } from "events";
import { JsonStreamOptionsManager } from "./json-stream-options-manager";
import { appendLog } from "./utils";
export class JsonStreamBufferManager<T> extends EventEmitter {
  private buffer = "";
  private previousBuffer = "";
  private lastCharEscaped = false;
  private lastCharEscapedIndex: number;
  private openQuote = false;
  private continueOnComma = false;
  private elementBuffer = "";
  private bracketNum = 0;
  private handledFirstBracket = false;
  private reset = false;
  private static readonly DETECTION_REGEX = /[{}\[\]\\",]/g;

  constructor(
    private readonly options: JsonStreamOptionsManager<T>,
    private readonly logger,
  ) {
    super();
  }

  public addChunkToBuffer(chunk: string) {
    this.buffer += chunk.toString();
  }

  public stop(): void {
    this.reset = true;
  }

  public fetchNextBuffer() {
    return this.buffer.length === 0;
  }

  /**
   * @desc Controls the state of the buffer. Can be either during detection or during acquisition.
   * The basic idea is that the JSON spec includes clues for how to process certain chars:
   * '\' will escape the next char rendering it invalid for our search
   * '"' will denote a string that if is opened must be closed.
   * '[' and '{' used to detect start of array or object
   * ']' and '}' used to detect close of array or object
   * bracketNum is used to tabulate the depth in the object we are in. This is used to detect false positives.
   * @param char
   * @param index
   */
  public processSingleChar(char: string, index: number): void {
    if (char === "\\") {
      this.lastCharEscapedIndex = index;
      return;
    }
    if (this.lastCharEscapedIndex === index + 1) {
      this.lastCharEscaped = true;
      this.lastCharEscapedIndex = undefined;
    }
    if (!this.lastCharEscaped && char === '"') {
      this.openQuote = !this.openQuote;
      return;
    }
    if (
      this.shouldIncludeBracket() &&
      this.isFirstBracket() &&
      (char === "{" || char === "[")
    ) {
      this.bracketNum++;
    } else if (this.shouldIncludeBracket() && (char === "}" || char === "]")) {
      this.bracketNum--;
    }
    this.lastCharEscaped = false;
  }
  public processCharsFix(char: string, index: number): void {
    if (char === "\\") {
      this.lastCharEscapedIndex = index;
      return;
    }
    if (this.lastCharEscapedIndex === index + 1) {
      this.lastCharEscaped = true;
      this.lastCharEscapedIndex = undefined;
    }
    if (!this.lastCharEscaped && char === '"') {
      this.openQuote = !this.openQuote;
      return;
    }
    if (
      this.shouldIncludeBracket() &&
      this.isFirstBracket() &&
      (char === "{" || char === "[")
    ) {
      this.bracketNum--;
    } else if (this.shouldIncludeBracket() && (char === "}" || char === "]")) {
      this.bracketNum++;
    }
    this.lastCharEscaped = false;
  }

  private shouldIncludeBracket() {
    return !this.openQuote && !this.lastCharEscaped;
  }

  private isFirstBracket() {
    if (!this.handledFirstBracket) {
      this.handledFirstBracket = true;
      return false;
    }
    return true;
  }
  public processChunk(): void {
    const regex = new RegExp(JsonStreamBufferManager.DETECTION_REGEX);
    const processType = this.options.getAttributeInProgress().type;
    let lastIndex = 0;
    let match;
    let currBuffer = this.buffer;
    while ((match = regex.exec(currBuffer)) !== null) {
      if (this.continueOnComma) {
        if (match[0] === "]") {
          this.emit("done");
          this.buffer = currBuffer.substring(match.index + 1);
          return;
        }
        this.continueOnComma = false;
        lastIndex = match.index + 1;
        continue;
      }
      this.elementBuffer += currBuffer.substring(lastIndex, match.index + 1);
      this.processSingleChar(match[0], match.index);
      if (this.bracketNum === 0) {
        this.emit("ready", this.elementBuffer);
        this.elementBuffer = "";
        if (processType === ParserValueType.Array) {
          if (this.reset) {
            this.reset = false;
            this.emit("done");
            this.buffer = currBuffer.substring(match.index + 1);
            return;
          }
          this.continueOnComma = true;
        } else {
          this.emit("done");
          this.buffer = currBuffer.substring(match.index + 2);
          this.previousBuffer = "";
          return;
        }
      }
      lastIndex = match.index + 1;
    }
    this.elementBuffer += currBuffer.substring(lastIndex);
    this.previousBuffer = this.buffer;
    this.buffer = "";
  }

  private findClosestAttribute(
    detectionBuffer: string,
  ): { attribute: keyof T; value: number } | null {
    const attributeRegexArr: (keyof T)[] = [];
    let attributesRegexExp: string[] = [];
    for (const attr of this.options.getAttributesToProcess()) {
      attributesRegexExp.push(this.options.getAttributeRegex(attr));
      attributeRegexArr.push(attr);
    }
    const regex = new RegExp(JsonStreamBufferManager.DETECTION_REGEX);
    const attrRegex = new RegExp(attributesRegexExp.join("|"), "g");
    let attributeMatches = attrRegex.exec(this.buffer);
    let detectionAttributeMatches = new RegExp(attrRegex).exec(detectionBuffer);
    if (
      detectionAttributeMatches &&
      detectionAttributeMatches.index !==
        attributeMatches?.index + this.previousBuffer.length
    ) {
      this.fixBuffer(
        attrRegex,
        detectionBuffer,
        attributeMatches ? attributeMatches[0] : undefined,
        attributeMatches?.index,
      );
      attributeMatches = new RegExp(attrRegex).exec(this.buffer);
    }
    let match;
    while ((match = regex.exec(this.buffer)) !== null) {
      if (!attributeMatches || attributeMatches.index > match.index) {
        this.processSingleChar(match[0], match.index);
      } else {
        const workingOnAttr = attributeRegexArr.find((attr) =>
          this.options.findAttributeInMatch(attr, attributeMatches[0]),
        );
        if (!!workingOnAttr) {
          if (this.bracketNum === 0) {
            return { value: attributeMatches.index, attribute: workingOnAttr };
          } else {
            this.processSingleChar(match[0], match.index);
            attributeMatches = attrRegex.exec(this.buffer);
          }
        }
      }
    }
    return null;
  }

  public detectRelevantObject(): void {
    const detectionBuffer = this.previousBuffer + this.buffer;
    const nextAttribute = this.findClosestAttribute(detectionBuffer);
    if (nextAttribute) {
      this.options.setAttributeInProgress(nextAttribute.attribute);
      this.logger.info(
        appendLog(`detected start of relevant key ${nextAttribute.attribute}`),
      );
      const totalOffset = this.options.findStartOffset(
        this.buffer,
        nextAttribute.value,
      );
      this.buffer = this.buffer.substring(totalOffset);
      this.previousBuffer = "";
    } else {
      this.previousBuffer = this.buffer;
      this.buffer = "";
    }
  }

  private fixBuffer(
    attrRegex: RegExp,
    detectionBuffer: string,
    attributeMatch?: string,
    attributeIndex?: number,
  ) {
    let detectionAttributeMatches = new RegExp(attrRegex);
    let detectionMatch;
    while (
      (detectionMatch = detectionAttributeMatches.exec(detectionBuffer)) !==
      null
    ) {
      if (
        !attributeIndex ||
        detectionMatch.index > this.previousBuffer.length + attributeIndex
      ) {
        const bufferToFix = this.previousBuffer.substring(detectionMatch.index);
        if (bufferToFix.length >= detectionMatch.index) {
          continue;
        }
        const regex = new RegExp(JsonStreamBufferManager.DETECTION_REGEX);
        let matchFix;
        while ((matchFix = regex.exec(bufferToFix)) !== null) {
          this.processCharsFix(matchFix[0], matchFix.index);
        }
        this.buffer = bufferToFix + this.buffer;
      }
    }
  }
}
