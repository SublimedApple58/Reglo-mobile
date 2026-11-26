import { View } from 'react-native';
import { NotificationInboxScreen } from '../../src/screens/NotificationInboxScreen';
import { useTabRootPadding } from '../../src/components/tabBarSpace';

export default function InboxTab() {
  // REG-800: con la barra nativa di iOS lo spazio in fondo lo tiene la tab.
  const pad = useTabRootPadding('inbox');
  return (
    <View style={{ flex: 1, paddingBottom: pad }}>
      <NotificationInboxScreen asTab />
    </View>
  );
}
