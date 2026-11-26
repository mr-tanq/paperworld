import * as PDFLib from 'npm:pdf-lib@1.17.1';
import {createStudio} from './studio.mjs';
Deno.serve(createStudio({environment:k=>Deno.env.get(k),PDFLib}).handle);
