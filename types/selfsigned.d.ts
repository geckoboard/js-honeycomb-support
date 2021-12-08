declare module 'selfsigned' {
  interface Options {
    days: number;
  }
  interface CertPair {
    private: string;
    public: string;
    cert: string;
  }
  export function generate(attrs: null, options: Options): CertPair;
}
