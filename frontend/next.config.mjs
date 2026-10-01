const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.MEDATLAS_BACKEND_URL || "http://127.0.0.1:8765"}/api/:path*` }];
  },
};

export default nextConfig;
