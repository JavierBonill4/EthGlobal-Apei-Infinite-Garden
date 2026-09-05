/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The art folder lives OUTSIDE web/ on purpose: it is the designer's
  // territory and should not be buried in frontend source. Symlink it into
  // public/ so Next serves it:
  //
  //   ln -s ../../art web/public/art
  //
  // (npm run dev will 404 every asset until you do.)
};
export default nextConfig;
