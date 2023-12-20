import {ParserValueType} from "./json-stream-transformer";
import {EventEmitter} from 'events';
import {JsonStreamOptionsManager} from "./json-stream-options-manager";
export class JsonStreamBufferManager<T> extends EventEmitter{
    private buffer = '';
    private previousBuffer = '';
    private lastCharEscaped = false;
    private lastCharEscapedIndex: number;
    private openQuote = false;
    private continueOnPsik = false;
    private elementBuffer = '';
    private bracketNum = 0;
    private handledFirstBracket = false;
    private reset = false;
    private static readonly DETECTION_REGEX = /[{}\[\]\\",]/g;
    private static readonly ADD_REQUIRED_CHARS_TO_START_ARR_INDEX = 4; // "attr":[
    private static readonly ADD_REQUIRED_CHARS_TO_START_OBJ_INDEX = 3; // "attr":

    constructor(private readonly options: JsonStreamOptionsManager<T>) {
        super()
    }

    public addChunkToBuffer(chunk: string) {
        this.buffer += chunk.toString();
        this.cleanNewLines();
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
        if (char === '\\') {
            this.lastCharEscapedIndex = index;
            return;
        }
        if(this.lastCharEscapedIndex === index + 1) {
            this.lastCharEscaped = true;
            this.lastCharEscapedIndex = undefined;
        }
        if (!this.lastCharEscaped && char === '"') {
            this.openQuote = !this.openQuote;
            return;
        }
        if (this.shouldIncludeBracket() && this.isFirstBracket() && (char === '{' || char === '[')) {
            this.bracketNum++;
        } else if (this.shouldIncludeBracket() && (char === '}' || char === ']')) {
            this.bracketNum--;
        }
        this.lastCharEscaped = false;
    }

    private shouldIncludeBracket() {
        return !this.openQuote && !this.lastCharEscaped
    }

    private isFirstBracket() {
        if(!this.handledFirstBracket) {
            this.handledFirstBracket = true;
            return false
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
            if (this.continueOnPsik) {
                if (match[0] === ']') {
                    this.emit('done');
                    this.buffer = currBuffer.substring(match.index + 1);
                    return;
                }
                this.continueOnPsik = false;
                lastIndex = match.index + 1;
                continue;
            }
            this.elementBuffer += currBuffer.substring(lastIndex, match.index + 1);
            this.processSingleChar(match[0], match.index);
            if (this.bracketNum === 0) {
                this.emit('ready', this.elementBuffer);
                this.elementBuffer = '';
                if(processType === ParserValueType.Array) {
                    if(this.reset) {
                        this.reset = false;
                        this.emit('done');
                        this.buffer = currBuffer.substring(match.index + 1);
                        return;
                    }
                    this.continueOnPsik = true;
                } else {
                    this.emit('done');
                    this.buffer = currBuffer.substring(match.index + 2);
                    this.previousBuffer = '';
                    return;
                }
            }
            lastIndex = match.index + 1;
        }
        this.elementBuffer += currBuffer.substring(lastIndex);
        this.previousBuffer = this.buffer;
        this.buffer = '';
    }

    private findClosestAttribute(detectionBuffer: string): { attribute: keyof T, value: number } | null{
        const attributeRegexArr: (keyof T)[] = [];
        let attributesRegexExp: string[] = [];
        for(const attr of this.options.getAttributesToProcess()) {
            attributesRegexExp.push(this.options.getAttributeRegex(attr))
            attributeRegexArr.push(attr)
        }
        const regex = new RegExp(JsonStreamBufferManager.DETECTION_REGEX);
        const attrRegex = new RegExp(attributesRegexExp.join('|'), 'g');
        let attributeMatches = attrRegex.exec(detectionBuffer);
        let match;
        while ((match = regex.exec(detectionBuffer)) !== null) {
            if(!attributeMatches || attributeMatches.index > match.index) {
                this.processSingleChar(match[0], match.index);
            } else {
                const workingOnAttr = attributeRegexArr.find(attr => this.options.findAttributeInMatch(attr, attributeMatches[0]));
                if(!!workingOnAttr) {
                    if (this.bracketNum === 0) {
                        return {value: attributeMatches.index, attribute: workingOnAttr}
                    } else {
                        this.processSingleChar(match[0], match.index);
                        attributeMatches = attrRegex.exec(detectionBuffer);
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
            this.options.setAttributeInProgress(nextAttribute.attribute)
            console.info(`detected start of relevant key ${nextAttribute}`);
            const attributeLength = (<string>nextAttribute.attribute).length;
            const offset: number = this.options.getAttributeInProgress().type === ParserValueType.Array ? JsonStreamBufferManager.ADD_REQUIRED_CHARS_TO_START_ARR_INDEX : JsonStreamBufferManager.ADD_REQUIRED_CHARS_TO_START_OBJ_INDEX;
            const totalOffset = this.options.findStartOffset(detectionBuffer, nextAttribute.value);
            if(totalOffset > this.previousBuffer.length) {
                // found in new buffer, previous buffer discard
                const bufferOffset = totalOffset - this.previousBuffer.length;
                this.buffer = this.buffer.substring(bufferOffset);
                this.previousBuffer = '';
            } else {
                // found in previous buffer, merge prev and current buffer from that point
                this.buffer = detectionBuffer.substring(totalOffset);
                this.previousBuffer = '';
            }
        } else {
            // not found in buffer at all, set prev as current
            this.previousBuffer = this.buffer;
            this.buffer = '';
            this.resetTrackers();
        }
    }

    private resetTrackers(){
        this.continueOnPsik = false;
        this.openQuote = false;
        this.lastCharEscaped = false;
    }

    private cleanNewLines() {
        // this.buffer = this.buffer.replace(/\{\n"/, '{\"');
        // this.buffer = this.buffer.replace(/,\n"/, ',\"');
        // this.buffer = this.buffer.replace(/\[\n"/, '[\"');
        // this.buffer = this.buffer.replace(/\[\n\{/, '[{');
    }
}