import {IParserTransformOptions, ParserValueType} from "./json-stream-transformer";

export class JsonStreamOptionsManager<T> {
    private attributeProcessed: (keyof T)[] = [];
    private currentAttribute: keyof T;
    constructor(private readonly options: IParserTransformOptions<T>[]) {

    }

    public getAttributesToProcess(): (keyof T)[]{
      return this.options.filter(o => !this.attributeProcessed.includes(o.attributeName))
          .map(o => o.attributeName);
    }

    public getAttributeInProgress(): IParserTransformOptions<T> {
        return this.options.find(o => o.attributeName === this.currentAttribute)
    }

    public isAttributeInProgress(): boolean {
        return !!this.currentAttribute;
    }

    public setCurrentAttributeProcessed() {
        this.attributeProcessed.push(this.currentAttribute);
        this.currentAttribute = null;
    }

    public setAttributeInProgress(attributeName: keyof T) {
        this.currentAttribute = attributeName;
    }

    public validateObject(buffer: string): object {
        try {
            const element = JSON.parse(buffer);
            return this.options.find(o => o.attributeName === this.currentAttribute).validator(element) ? element : null
        } catch (e) {
            console.warn('first element failed JSON.parse');
            return null;
        }
    }

    public getAttributeRegex(attributeName: keyof T): string {
        const char = this.options.find(o => o.attributeName === attributeName).type === ParserValueType.Array ? '[' : '{';
        return `"${attributeName}":\\s*\\${char}`
    }

    public findAttributeInMatch(attributeName: keyof T, match: string): boolean {
        return match.includes(`\"${attributeName}\":`)
    }

    public findStartOffset(buffer: string, attributeStartIndex: number): number {
        const toStart: string = buffer.substring(attributeStartIndex);
        return (this.getAttributeInProgress().type === ParserValueType.Array ? toStart.indexOf('[') + 1 : toStart.indexOf('{')) + attributeStartIndex
    }

}