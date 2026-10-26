/**
 * jest.resolver.js — resolve the *web* build of Reanimated and Worklets.
 *
 * Both packages ship a `.native` implementation that needs the real native
 * runtime, which does not exist under Jest. Their own jest resolvers strip the
 * `.native` extensions; this resolver does the same for both packages so the
 * QA sweep can mount the real screens.
 */
module.exports = (request, options) => {
  const touches = (name) =>
    options.basedir.includes(name) || request.includes(name);
  if (touches('react-native-worklets') || touches('react-native-reanimated')) {
    const next = { ...options };
    next.extensions = next.extensions?.filter((extension) => !extension.includes('native'));
    options = next;
  }
  return options.defaultResolver(request, options);
};
